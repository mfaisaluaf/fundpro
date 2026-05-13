// Lightweight DOM toast — works from anywhere, no React state needed

export function showToast(message, type = 'success') {
  // Remove any existing toast
  document.querySelector('.fp-toast')?.remove()

  const el = document.createElement('div')
  el.className = `fp-toast fp-toast-${type}`
  el.textContent = message
  document.body.appendChild(el)

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('fp-toast-visible'))
  })

  // Animate out & remove
  setTimeout(() => {
    el.classList.remove('fp-toast-visible')
    setTimeout(() => el.remove(), 300)
  }, 2200)
}
