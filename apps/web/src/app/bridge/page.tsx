/**
 * /bridge — the postMessage hint endpoint embedded as an iframe by the SDK
 * on third-party dApps. Serves ONLY the three display fields (avatar,
 * username, optional ENS) from the first-party session — the dApp can
 * never read the DID, address, or credentials through this bridge.
 */
export default function Bridge() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  if (typeof window === "undefined") return;
  function post() {
    var hint = null;
    try { hint = JSON.parse(localStorage.getItem("soverity:hint") || "null"); } catch (e) {}
    parent.postMessage(
      { type: "soverity:hint", hint: hint ? [hint] : [] },
      { targetOrigin: "*" }
    );
  }
  window.addEventListener("message", function (event) {
    if (event.data === "soverity:probe") post();
  });
  post();
})();
`,
      }}
    />
  );
}
