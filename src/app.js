import * as THREE from 'three'
import {initScenePipelineModule, toggleEvidenceMode} from './scene.js'

window.THREE = THREE

const start = () => {
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
    if (status) status.textContent = 'Koordinatni sustav ponovno centriran.'
  })

  const evidence = document.getElementById('evidence')
  evidence?.addEventListener('click', () => {
    const active = toggleEvidenceMode()
    evidence.classList.toggle('active', active)
    evidence.textContent = active ? 'Immersive mode' : 'Evidence mode'
    const status = document.getElementById('status')
    if (status) {
      status.textContent = active
        ? 'Evidence mode: potvrđeno ostaje čvrsto, vjerojatno i spekulativno postaju prozirni.'
        : 'Immersive mode: svi elementi prikazani su potpuno.'
    }
  })
}

window.XR8 ? start() : window.addEventListener('xrloaded', start)
