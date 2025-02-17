function initializeControls(warpedMapLayer) {
  document.querySelector('#opacity').addEventListener('input', (event) => {
    const opacity = event.target.valueAsNumber
    warpedMapLayer.setOpacity(opacity)
  })

  function setRemoveBackground() {
    const removeBackground = document.querySelector(
      '#remove-background-color'
    ).checked

    if (removeBackground) {
      const color = document.querySelector('#background-color').value

      const threshold = document.querySelector(
        '#background-color-threshold'
      ).valueAsNumber

      const hardness = document.querySelector(
        '#background-color-hardness'
      ).valueAsNumber

      warpedMapLayer.setRemoveBackground({
        hexColor: color,
        threshold,
        hardness
      })
    } else {
      warpedMapLayer.resetRemoveBackground()
    }
  }

  function setColorize() {
    const colorize = document.querySelector('#colorize').checked
    if (colorize) {
      const colorizeColor = document.querySelector('#colorize-color').value
      warpedMapLayer.setColorize(colorizeColor)
    } else {
      warpedMapLayer.resetColorize()
    }
  }

  document
    .querySelector('#remove-background-color')
    .addEventListener('input', (event) => setRemoveBackground())

  document
    .querySelector('#background-color')
    .addEventListener('input', () => setRemoveBackground())

  document
    .querySelector('#background-color-threshold')
    .addEventListener('input', (event) => setRemoveBackground())

  document
    .querySelector('#background-color-hardness')
    .addEventListener('input', (event) => setRemoveBackground())

  document
    .querySelector('#colorize')
    .addEventListener('input', () => setColorize())

  document
    .querySelector('#colorize-color')
    .addEventListener('input', () => setColorize())
}
