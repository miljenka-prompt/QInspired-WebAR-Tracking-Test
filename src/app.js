import * as THREE from 'three'
import {getSpatialSubject, initScenePipelineModule, toggleSpatialVideo} from './scene.js'

window.THREE = THREE

const subject = getSpatialSubject()

const start = () => {
  const pill = document.querySelector('.pill')
  if (pill) pill.textContent = `QInspired Heritage AR · ${subject.title} · spatial alpha test`
  document.title = `QInspired Heritage AR — ${subject.title}`

  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),
    LandingPage.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XRExtras.Loading.pipelineModule(),
    XRExtras.RuntimeError.pipelineModule(),
    initScenePipelineModule(),
  ])

  const canvas = document.getElementById('camerafeed')
  XR8.run({canvas})

  const recenter = document.getElementById('recenter')
  recenter?.addEventListener('click', () => {
    XR8.XrController.recenter()
    const status = document.getElementById('status')
    if (status) status.textContent = `${subject.label[0].toUpperCase()}${subject.label.slice(1)} je ponovno usidren prema trenutačnoj poziciji kamere.`
  })

  const videoButton = document.getElementById('video-toggle')
  videoButton?.addEventListener('click', async () => {
    try {
      const playing = await toggleSpatialVideo()
      videoButton.textContent = playing ? 'Pauziraj video' : 'Pokreni video'
    } catch (error) {
      const status = document.getElementById('status')
      if (status) status.textContent = 'Browser je blokirao autoplay. Dodirni ponovno za pokretanje videa.'
    }
  })
}

window.XR8 ? start() : window.addEventListener('xrloaded', start)
