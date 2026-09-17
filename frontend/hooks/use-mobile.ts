import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// Ekran genişliği React dışında bir kaynak; effect içinde state güncellemek yerine
// useSyncExternalStore ile okuyoruz (React 19 lint kuralı effect içindeki setState'i hata sayıyor).
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

// Sunucuda pencere yok; ilk render masaüstü kabul edilir, tarayıcıda gerçek değerle güncellenir.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
