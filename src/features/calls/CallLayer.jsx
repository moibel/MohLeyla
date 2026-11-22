import { useCalls } from './useCalls.js';
import CallScreen from './CallScreen.jsx';
import IncomingCall from './IncomingCall.jsx';

/** Mounted once in the app layout: shows the active call, or the next ringing call. */
export default function CallLayer() {
  const { active, incoming } = useCalls();
  if (active) return <CallScreen key={active.callId} call={active} />;
  if (incoming.length) return <IncomingCall key={incoming[0].call_id} call={incoming[0]} />;
  return null;
}
