import { useEffect, useRef, useState } from 'react'
import type { TranslationKey } from '../../core/localization/translations'
import { useLocalization } from '../context/localization-context'
import { Button } from '../../shared/ui'

type CameraPhotoCaptureProps = {
  photo: string | null
  onChange: (photo: string | null) => void
}

export function CameraPhotoCapture({ photo, onChange }: CameraPhotoCaptureProps) {
  const { t } = useLocalization()
  const cameraRef = useRef<HTMLVideoElement>(null)
  const activeStream = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)

  const stopCamera = () => {
    activeStream.current?.getTracks().forEach((track) => track.stop())
    activeStream.current = null
    setCameraActive(false)
  }

  useEffect(() => () => {
    activeStream.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    const video = cameraRef.current
    if (cameraActive && video && activeStream.current) {
      video.srcObject = activeStream.current
      void video.play().catch(() => setError('shiftCameraNotReady'))
    }
  }, [cameraActive])

  const startCamera = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('shiftCameraUnavailable')
      return
    }
    try {
      activeStream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      })
      setCameraActive(true)
    } catch {
      setError('shiftCameraPermissionDenied')
    }
  }

  const takePhoto = () => {
    const video = cameraRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('shiftCameraNotReady')
      return
    }
    const scale = Math.min(1, 1280 / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) {
      setError('shiftCameraNotReady')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    onChange(canvas.toDataURL('image/jpeg', 0.78))
    setError(null)
    stopCamera()
  }

  return (
    <div className="shift-opening-gate__capture">
      <div className="shift-opening-gate__camera">
        {photo ? (
          <img src={photo} alt={t('shiftPhotoCaptured')} />
        ) : cameraActive ? (
          <video ref={cameraRef} autoPlay playsInline muted />
        ) : (
          <div className="shift-opening-gate__placeholder">{t('shiftCameraPlaceholder')}</div>
        )}
      </div>
      {error ? <p className="shift-opening-gate__error" role="alert">{t(error)}</p> : null}
      <div className="shift-opening-gate__actions">
        {photo ? (
          <Button variant="secondary" onClick={() => { onChange(null); void startCamera() }}>
            {t('shiftRetakePhoto')}
          </Button>
        ) : cameraActive ? (
          <Button variant="primary" onClick={takePhoto}>{t('shiftTakePhoto')}</Button>
        ) : (
          <Button variant="primary" onClick={() => void startCamera()}>{t('shiftEnableCamera')}</Button>
        )}
      </div>
    </div>
  )
}
