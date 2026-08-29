import { WebApp } from "./app/WebApp";
import { WebRuntimeProvider } from "./app/WebRuntimeProvider";

export default function App() {
  return (
    <WebRuntimeProvider>
      <WebApp />
    </WebRuntimeProvider>
  );
}
