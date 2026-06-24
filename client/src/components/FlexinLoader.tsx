// FlexinLoader — intentionally renders a blank dark screen.
//
// Per product direction, we don't want any pulsing logo / "loading" spinner
// flashing on top of the login or app boot. Returning an empty dark surface
// keeps the screen quiet during the ~100ms user-fetch window, then App.tsx
// swaps in the real screen as soon as the query resolves.
export function FlexinLoader(_: { text?: string } = {}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0d0f1a",
      }}
    />
  );
}
