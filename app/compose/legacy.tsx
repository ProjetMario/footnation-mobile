// Compatibility alias for old links: always use the modern creation tunnel.
import CreationStudio from "../../src/screens/CreationStudio";

export default function LegacyComposeRoute() {
  return <CreationStudio defaultMode="post" />;
}
