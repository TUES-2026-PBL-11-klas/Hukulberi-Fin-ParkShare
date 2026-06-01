import LeafletMap from "./LeafletMap";
import PageViewBeacon from "./PageViewBeacon";

export default function Home() {
  return (
    <>
      <PageViewBeacon page="home" />
      <LeafletMap />
    </>
  );
}
