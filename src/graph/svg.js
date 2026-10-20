// Creates an svg element with the given attributes and children
// `style` takes an object of css properties
// `text` sets the text content
export function el(tag, attributes = {}, children = []) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) {
      continue
    }
    if (name === 'style') {
      Object.assign(element.style, value)
    } else if (name === 'text') {
      element.textContent = value
    } else {
      element.setAttribute(name, value)
    }
  }
  for (const child of children) {
    if (child) {
      element.append(child)
    }
  }
  return element
}
