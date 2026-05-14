import type { CSSProperties } from 'react'

export interface PhotoAdjustment {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_PHOTO_ADJUSTMENT: PhotoAdjustment = {
  x: 50,
  y: 50,
  zoom: 120,
}

export function parsePhotoAdjustment(value?: string | null): PhotoAdjustment {
  if (!value) return DEFAULT_PHOTO_ADJUSTMENT
  const parts = value.match(/\d+/g)?.map(Number) ?? []

  return {
    x: clamp(parts[0] ?? DEFAULT_PHOTO_ADJUSTMENT.x, 0, 100),
    y: clamp(parts[1] ?? DEFAULT_PHOTO_ADJUSTMENT.y, 0, 100),
    zoom: clamp(parts[2] ?? DEFAULT_PHOTO_ADJUSTMENT.zoom, 100, 240),
  }
}

export function serializePhotoAdjustment(adjustment: PhotoAdjustment) {
  return `${adjustment.x}% ${adjustment.y}% ${adjustment.zoom}%`
}

export function getAdjustedPhotoStyle(value?: string | null): CSSProperties {
  const adjustment = parsePhotoAdjustment(value)
  return {
    objectPosition: `${adjustment.x}% ${adjustment.y}%`,
    transform: `scale(${adjustment.zoom / 100})`,
    transformOrigin: `${adjustment.x}% ${adjustment.y}%`,
  }
}

export function savePhotoAdjustment(studentId: string, value?: string | null) {
  if (!value || typeof window === 'undefined') return
  window.localStorage.setItem(getPhotoAdjustmentKey(studentId), value)
}

export function getSavedPhotoAdjustment(studentId: string) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(getPhotoAdjustmentKey(studentId))
}

function getPhotoAdjustmentKey(studentId: string) {
  return `approf:student-photo-adjustment:${studentId}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
