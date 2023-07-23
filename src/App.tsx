import { useReplit } from '@replit/extensions-react';
import { useState, useEffect } from 'react';
import './App.css'
import { nip19, generatePrivateKey, getPublicKey, Event, getEventHash, getSignature, relayInit } from 'nostr-tools';
import 'websocket-polyfill'


export const RELAYS = [
    "wss://nostr-pub.wellorder.net",
    "wss://nostr.drss.io",
    "wss://nostr.swiss-enigma.ch",
    "wss://relay.damus.io",
];

const relayPool = new RelayPool(RELAYS);

function App() {
    // Replit Stuff: Handshake status, error (if any), and Replit API wrapper
    const { status, error, replit } = useReplit();
    if (status === "error") return <div className="text-red-500">{error?.message}</div>;
    if (status === "loading") return <div>Loading...</div>;

    const [sk, setSk] = useState(null);
    const [pk, setPk] = useState<string>("");
    const [shortNpub, setShortNpub] = useState<string>("");
    const [story, setStory] = useState<string>("");
    const [eventFeed, setEventFeed] = useState<Event[]>([]);
    const [relay, setRelay] = useState(null);
    const [relayUrl, setRelayUrl] = useState(RELAYS[0]);
    const [relayStatus, setRelayStatus] = useState('Connecting...');

    useEffect(() => {
        const _relay = relayInit(relayUrl);
        setRelay(_relay);

        _relay.on('connect', () => {
            console.log(`connected to ${_relay.url}`);
            setRelayStatus('Connected');
        });

        _relay.on('error', () => {
            console.log(`failed to connect to ${_relay.url}`);
            setRelayStatus('Disconnected');
        });

        _relay.connect().then(() => {
            let sub = _relay.sub([
                {
                    kinds: [1],
                    authors: [pk]
                }
            ]);
            sub.on('event', event => {
                const eventExists = eventFeed.find(e => e.id === event.id);
                if (!eventExists) {
                    setEventFeed([event, ...eventFeed]);
                }
            });
        });

        return () => {
            _relay.close();
        };
    }, [pk, relayUrl]);

    const handleRelayChange = (e) => {
        e.preventDefault();
        setRelayUrl(e.target.elements.relayUrl.value);
    };

    // useEffect to check if there's a npub or nsec in the localstorage
    useEffect(() => {
        const nsec = localStorage.getItem("nsec");
        if (nsec) {
            setSk(nip19.decode(nsec).data);
        }
        const npub = localStorage.getItem("npub");
        if (npub) {
            setPk(nip19.decode(npub).data);
            const short = npub.slice(0, 6) + "..." + npub.slice(-6);
            setShortNpub(short);
        }
    }, []);

    const handleKeygen = () => {
        const sk = generatePrivateKey();
        localStorage.setItem("nsec", nip19.nsecEncode(sk));
        setSk(sk);
        const pk = getPublicKey(sk);
        localStorage.setItem("npub", nip19.npubEncode(pk));
        setPk(pk);
        const npub = nip19.npubEncode(pk);
        const short = npub.slice(0, 6) + "..." + npub.slice(-6);
        setShortNpub(short);

    };

    const handleRollKey = () => {
        localStorage.removeItem("nsec");
        localStorage.removeItem("npub");
        setSk(null);
        handleKeygen();
        setEventFeed([]);
    }

    const handleSubmit = async () => {
        if (!relay || !story || !sk) return;
        let event = {
            kind: 1,
            pubkey: pk,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: story
        }
        event.id = getEventHash(event);
        event.sig = getSignature(event, sk);
        let pub = relay.publish(event);
        pub.on('ok', () => {
            console.log(`${relay.url} has accepted our event`);
            setEventFeed(prevEvents => [...prevEvents, event]);
        });
        pub.on('failed', reason => {
            console.log(`failed to publish to ${relay.url}: ${reason}`);
        });
        setStory("");
    }

    return (
        <main className="flex flex-col items-center min-h-screen bg-gray-800 text-white px-4 pt-6">
            <h1 className="text-3xl mb-4">Nostr.it: An AI Vending Machine Client</h1>

            <div className={`status-bar mb-4 flex items-center justify-center bg-white text-gray-800 rounded-full border border-white ${relayStatus === 'Connected' ? 'bg-green-400' : 'bg-red-400'}`}>
                <span className="px-2 py-1">
                    Relay Status: {relayStatus}
                </span>
            </div>

            {relayStatus !== 'Connected' && (
                <form className="w-full max-w-lg flex items-center my-4 bg-white text-gray-800 rounded-full border border-white" onSubmit={handleRelayChange}>
                    <input id="relayUrl" type="text" className="flex-grow p-2 rounded-l-full" placeholder="wss://..." />
                    <button className="px-2 py-1 rounded-r-full text-gray-800 hover:bg-gray-300 transition duration-200" type="submit">Connect</button>
                </form>
            )}

            {shortNpub !== "" ? (
                <div className="text-xl mt-4 items-center justify-between rounded-lg bg-gray-800 text-white border-white border">
                    <button
                        className="px-2 py-2  mx-1 hover:bg-gray-700 transition duration-200 rounded-lg"
                        onClick={async () => await handleRollKey()}
                    >
                        🔄 Roll Key :
                    </button>
                    <span className="px-2">@{shortNpub}</span>
                </div>
            ) : (
                <div className="my-4">
                    <button
                        className="px-2 py-1 rounded-lg bg-gray-800 text-white border-white border mx-1 hover:bg-gray-700 transition duration-200"
                        onClick={async () => await handleKeygen()}
                    >
                        Gen PK
                    </button>
                </div>
            )}
            <form className="w-full max-w-lg flex items-center my-4 bg-white text-gray-800 rounded-full border border-white" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="flex-grow p-2 rounded-l-full"
                    placeholder="Write me a story"
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                />
                <button
                    className="px-2 py-1 rounded-r-full text-gray-800 hover:bg-gray-300 transition duration-200"
                    type="submit"
                >
                    Submit Job
                </button>
            </form>

            <div className="w-full max-w-lg p-4 bg-white rounded-lg text-gray-800 my-4">
                {<div className="w-full max-w-lg p-4 bg-white rounded-lg text-gray-800 my-4">
                    {eventFeed.map((event, index) => (
                        <div key={index} className="border-b border-gray-200 p-2">
                            <div><strong>Kind:</strong> {event.kind}</div>
                            <div><strong>From:</strong> {event.pubkey}</div>
                            <div><strong>Content:</strong> {event.content}</div>
                        </div>
                    ))}
                </div>}
            </div>
        </main>


    );
}

export default App;