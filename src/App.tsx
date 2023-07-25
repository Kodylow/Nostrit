import { useReplit } from '@replit/extensions-react';
import { useState, useEffect } from 'react';
import './App.css'
import { nip19 } from 'nostr-tools';
import 'websocket-polyfill'
import NDK from '@nostr-dev-kit/ndk';
import { NDKNip07Signer, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import type { NostrEvent } from '@nostr-dev-kit/ndk';

export const RELAYS = [
    "wss://relay.damus.io",
    // "wss://nostr.drss.io",
    "wss://nostr.swiss-enigma.ch",
    "wss://relay.f7z.io",
];

function App() {
    // Replit Stuff: Handshake status, error (if any), and Replit API wrapper
    // const { status, error, replit } = useReplit();
    // if (status === "error") return <div className="text-red-500">{error?.message}</div>;
    // if (status === "loading") return <div>Loading...</div>;

    const [pk, setPk] = useState<string>("");
    const [shortNpub, setShortNpub] = useState<string>("");
    const [userInput, setUserInput] = useState<string>("");
    const [eventFeed, setEventFeed] = useState<NDKEvent[]>([]);
    const [showEventFeed, setShowEventFeed] = useState<boolean>(false);
    const [ndk, setNDK] = useState<NDK>();
    const [relay, setRelay] = useState(null);
    const [relayUrl, setRelayUrl] = useState(RELAYS[3]);
    const [relayStatus, setRelayStatus] = useState('Initially Not connected...');
    const [publishedJobIDs, setPublishedJobIDs] = useState<string[]>([]);
    const [sub, setSub] = useState<NDKSubscription | null>(null);

    useEffect(() => {

        async function init() {
            console.log("running init");
            const signer = new NDKNip07Signer();
            let _ndk = new NDK({
                explicitRelayUrls: RELAYS,
                signer
            });

            _ndk.pool.on("relay:connect", async (r) => {
                console.log('connected to a relay', r.url);
                setRelayStatus("Connected")
            });
            _ndk.pool.on("connect", async () => {
                const user = await signer.user();
                console.log('connected to something', _ndk.pool.stats());
                // const sub = _ndk.subscribe({
                //     since: Math.floor(Date.now() / 1000),
                //     kinds: [68001],
                //     '#p': [user.hexpubkey()]
                // }, { closeOnEose: false, groupable: false });

                // sub.on('event', (event: NDKEvent) => {
                //     console.log("saw event", event.rawEvent())
                //     // const eventExists = eventFeed.find(e => e.id === event.id);
                //     setEventFeed([event, ...eventFeed]);
                // })
            });
            _ndk.connect(2500);
            setNDK(_ndk);

            if (window.nostr === "undefined") {
                // notify fu
                return;
            }
            const pubkey = await window.nostr.getPublicKey()
            console.log("pubkey from Alby: ", pubkey);
            setPk(pubkey);

            // const _relay = relayInit(relayUrl);

            // _relay.on('connect', () => {
            //   console.log(`connected to ${_relay.url}`);
            //   setRelayStatus('Connected');
            // });

            // _relay.on('error', () => {
            //   console.log(`failed to connect to ${_relay.url}`);
            //   setRelayStatus('Disconnected');
            // });



            // _relay.connect().then(() => {
            //   let sub = _relay.sub(
            //     [
            //       {
            //         kinds: [68002],
            //         "#p": [pk]
            //       }
            //     ]
            //   )
            //   sub.on('event', event => {
            //     // Extract the customer's pubkey from the incoming event
            //     console.log("saw event", event)
            //     const eventExists = eventFeed.find(e => e.id === event.id);
            //     setEventFeed([event, ...eventFeed]);
            //   });
            // }).catch((error) => {
            //   console.log(`Failed to connect to ${_relay.url}: ${error}`);
            //   setRelayStatus('Failed to connect');
            // });

            // setRelay(_relay);
        }

        init();

        return () => {
            if (relay) {
                relay.close();
            }
        };
    }, [pk, relayUrl]);

    const handleRelayChange = (e) => {
        e.preventDefault();
        setRelayUrl(e.target.elements.relayUrl.value);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput) return;
        const event = new NDKEvent(ndk, {
            kind: 68005,
            tags: [
                ["j", "code-review"],
                ["bid", "10000"]
            ],
            content: userInput
        } as NostrEvent);

        await event.sign();

        // check if there is a subscription running here
        if (sub !== null) {
            console.log("already subscribed");
            sub.stop()
        }

        // create a subscription
        const newSub = ndk?.subscribe({
            ...event.filter()
        }, { closeOnEose: false, groupable: false });
        newSub!.on('event', (event: NDKEvent) => {
            // add event to event feed
            setEventFeed(prevEventFeed => [event, ...prevEventFeed]);

        })
        setSub(newSub!);

        console.log('signed_event', event.rawEvent());
        await event.publish();
        setUserInput("");

        console.log("Set userInput to null")
    }

    const handleZap = async (e: Event) => {
        if (window.webln === "undefined") {
            alert("You need to use a webln enabled browser or extension to zap for these jobs! Download Alby at https://getalby.com !");
            return;
        }

        await window.webln.enable();
        const invoice = e.tags.find(tag => tag[0] === 'amount')?.[2];
        const { preimage } = await window.webln.sendPayment(invoice)

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
            {pk && (
                <p>{nip19.npubEncode(pk)}</p>
            )}
            <form className="w-full max-w-lg flex items-center my-4 bg-white text-gray-800 rounded-full border border-white" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="flex-grow p-2 rounded-l-full"
                    placeholder="Fix my janky code..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                />
                <button
                    className="px-2 py-1 rounded-r-full text-gray-800 hover:bg-gray-300 transition duration-200"
                    type="submit"
                >
                    Submit Job
                </button>
            </form>

            {eventFeed.length > 0 && (
                <div className="w-full max-w-lg p-4 bg-white rounded-lg text-gray-800 my-4 overflow-y-auto">
                    {eventFeed.map((event, index) => {
                        // Extract the necessary tag data
                        const amountSats = event.tags.find(tag => tag[0] === 'amount')?.[1] / 1000;

                        return (
                            <div key={index} className="border-b border-gray-200 p-2 flex justify-between items-center">
                                <div>
                                    <div><strong>From:</strong> {event.author.npub}</div>
                                    <div><strong>Content:</strong> {event.content}</div>
                                </div>
                                {amountSats && <button
                                    className="px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition duration-200"
                                    onClick={() => handleZap(event)} // assuming you're passing the event id to handleZap
                                >
                                    Zap ⚡ {amountSats}
                                </button>
                                }
                            </div>
                        )
                    })}
                </div>
            )}
        </main >


    );
}

export default App;