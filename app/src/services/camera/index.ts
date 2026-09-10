/**
 * The reader's image: taken by the device's camera and downloaded over WiFi (ADR 0003).
 *
 * Until 2026-09-08 the phone's camera (`expo-image-picker`) also lived here, holding that place
 * while there was no hardware, along with the photo library, which was useful for handing the same
 * photo to several models. Both left once the hardware worked: the product's only image source is
 * the device, and keeping a second one left `expo-image-picker` and the camera and photo permissions
 * in the binary for a path nobody walks any more.
 *
 * Pure barrel: the single import surface (`@/services/camera`).
 */
export { downloadDevicePhoto } from './devicePhoto';
export type { DevicePhoto, CloudImage } from './devicePhoto';
