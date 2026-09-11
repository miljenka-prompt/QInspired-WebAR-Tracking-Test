import * as THREE from 'three'

let evidenceMode = false
let heritageObject = null

const buildHeritageObject = () => {
  const group = new THREE.Group()
  group.name = 'heritage-test-object'

  const confirmed = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 0.55),
    new THREE.MeshStandardMaterial({color: 0xb78a5b, roughness: 0.75, transparent: true, opacity: 1})
  )
  confirmed.position.y = 0.175
  confirmed.userData.evidenceOpacity = 1.0
  confirmed.userData.evidenceTag = 'confirmed'
  confirmed.castShadow = true
  group.add(confirmed)

  const probable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.9, 24),
    new THREE.MeshStandardMaterial({color: 0x7d5b3d, roughness: 0.8, transparent: true, opacity: 1})
  )
  probable.position.set(-0.3, 0.8, 0)
  probable.userData.evidenceOpacity = 0.65
  probable.userData.evidenceTag = 'probable'
  probable.castShadow = true
  group.add(probable)

  const speculative = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 24),
    new THREE.MeshStandardMaterial({color: 0xd8b36a, roughness: 0.6, transparent: true, opacity: 1})
  )
  speculative.position.set(0.25, 0.62, 0)
  speculative.userData.evidenceOpacity = 0.3
  speculative.userData.evidenceTag = 'speculative'
  speculative.castShadow = true
  group.add(speculative)

  return group
}

const setOpacity = (mesh, opacity) => {
  if (!mesh.material) return
  mesh.material.transparent = true
  mesh.material.opacity = opacity
  mesh.material.needsUpdate = true
}

const applyEvidenceMode = () => {
  if (!heritageObject) return
  heritageObject.traverse((child) => {
    if (!child.isMesh) return
    setOpacity(child, evidenceMode ? (child.userData.evidenceOpacity ?? 1) : 1)
  })
}

export const toggleEvidenceMode = () => {
  evidenceMode = !evidenceMode
  applyEvidenceMode()
  return evidenceMode
}

export const initScenePipelineModule = () => ({
  name: 'qinspired-modern-scene',

  onStart: ({canvas}) => {
    const {scene, camera, renderer} = XR8.Threejs.xrScene()

    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.25))

    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(2, 5, 3)
    sun.castShadow = true
    scene.add(sun)

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({opacity: 0.28})
    )
    shadowPlane.rotation.x = -Math.PI / 2
    shadowPlane.receiveShadow = true
    scene.add(shadowPlane)

    heritageObject = buildHeritageObject()
    heritageObject.position.set(0, 0, -1.5)
    scene.add(heritageObject)

    camera.position.set(0, 1.6, 2.5)

    XR8.XrController.updateCameraProjectionMatrix({
      origin: camera.position,
      facing: camera.quaternion,
    })

    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})

    const status = document.getElementById('status')
    if (status) status.textContent = 'Tracking aktivan. Objekt bi trebao ostati usidren dok se krećeš.'
  },
})
