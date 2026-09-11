import * as THREE from 'three'

let theropodVideo = null
let theropodPlane = null

const VIDEO_URL = 'https://miljenka-prompt.github.io/AR-kredna-obala-Istarskog-arhipelaga/Cretaceous_teropod.mp4'

const setStatus = (text) => {
  const status = document.getElementById('status')
  if (status) status.textContent = text
}

const buildTheropodVideoPlane = (scene) => {
  theropodVideo = document.createElement('video')
  theropodVideo.src = VIDEO_URL
  theropodVideo.crossOrigin = 'anonymous'
  theropodVideo.loop = true
  theropodVideo.muted = true
  theropodVideo.playsInline = true
  theropodVideo.setAttribute('playsinline', '')
  theropodVideo.setAttribute('webkit-playsinline', '')
  theropodVideo.preload = 'auto'

  const texture = new THREE.VideoTexture(theropodVideo)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    toneMapped: false,
  })

  // Start at a 16:9-like size; correct to the video's real aspect ratio once metadata arrives.
  const targetHeight = 1.8
  const geometry = new THREE.PlaneGeometry(3.2, targetHeight)
  theropodPlane = new THREE.Mesh(geometry, material)
  theropodPlane.name = 'world-locked-cretaceous-theropod-video'
  theropodPlane.position.set(0, targetHeight / 2, -1.5)
  scene.add(theropodPlane)

  theropodVideo.addEventListener('loadedmetadata', () => {
    if (!theropodPlane || !theropodVideo.videoWidth || !theropodVideo.videoHeight) return
    const aspect = theropodVideo.videoWidth / theropodVideo.videoHeight
    const width = targetHeight * aspect
    theropodPlane.geometry.dispose()
    theropodPlane.geometry = new THREE.PlaneGeometry(width, targetHeight)
    setStatus('Theropod je usidren u prostoru. Kreći se lijevo/desno i provjeri ostaje li na mjestu.')
  })

  theropodVideo.addEventListener('error', () => {
    setStatus('Video se nije učitao. Tracking je aktivan; pokušaj osvježiti stranicu.')
  })

  theropodVideo.play().catch(() => {
    setStatus('Tracking je aktivan. Dodirni “Pokreni video” za theropoda.')
  })
}

export const toggleTheropodVideo = async () => {
  if (!theropodVideo) return false

  if (theropodVideo.paused) {
    await theropodVideo.play()
    return true
  }

  theropodVideo.pause()
  return false
}

export const initScenePipelineModule = () => ({
  name: 'qinspired-theropod-video-scene',

  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()

    buildTheropodVideoPlane(scene)

    camera.position.set(0, 1.6, 2.5)

    XR8.XrController.updateCameraProjectionMatrix({
      origin: camera.position,
      facing: camera.quaternion,
    })

    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})

    setStatus('Tracking aktivan. Theropod video se učitava…')
  },
})
