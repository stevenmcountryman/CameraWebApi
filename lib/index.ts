import { ICamera } from './ICamera';
import { ICameraConstraints, IDimensions } from './ICameraConstraints';

export class Camera {

    private _constaints: ICameraConstraints;
    private _isLoading = true;
    private _allCameras: MediaDeviceInfo[] = [];
    private _rearCameras: MediaDeviceInfo[] = [];
    private _frontCameras: MediaDeviceInfo[] = [];
    private _currFrontIndex = 0;
    private _currRearIndex = 0;
    private _streams = new Map<string, MediaStream>();
    private _currDirection: 'Front' | 'Rear' = 'Rear';
    private _isStreaming = false;

    constructor(width: IDimensions, height: IDimensions) {
        this._constaints = {
            video: {
                width: width,
                height: height,
                deviceId: {
                    exact: ''
                }
            }
        };

        if (this.isApiSupported()) {
            this._isLoading = true;
            this.getCameras().then(success => {
                if (success) {
                    this.loadCameras();
                }
            });
        } else {
            console.error('Cannot get camera devices. API not supported.');
        }
    }

    /** Is the Camera loading devices */
    public get isLoading(): boolean {
        return this._isLoading;
    }

    /** Is the Camera currently streaming */
    public get isStreaming(): boolean {
        return this._isStreaming;
    }

    /** All available cameras */
    public get allCameras(): ICamera[] {
        return this._allCameras.map(c => {
            return {
                deviceId: c.deviceId,
                label: c.label
            }
        });
    }

    /** All available rear cameras */
    public get frontCameras(): ICamera[] {
        return this._frontCameras.map(c => {
            return {
                deviceId: c.deviceId,
                label: c.label
            }
        })
    }

    /** All available front cameras */
    public get rearCameras(): ICamera[] {
        return this._rearCameras.map(c => {
            return {
                deviceId: c.deviceId,
                label: c.label
            }
        })
    }

    /** Has more than 1 available camera in the current direction. */
    public canToggleLenses(): boolean {
        if (this._currDirection === 'Front') {
            return this._frontCameras.length > 1;
        } else if (this._currDirection === 'Rear') {
            return this._rearCameras.length > 1;
        } else {
            console.error('How did we end up here?');
            return false;
        }
    }

    /** Has both front and rear cameras. */
    public canSwitchCameraDirections(): boolean {
        return this.rearCameras.length > 0 && this.frontCameras.length > 0;
    }

    /** 
     * Toggle current camera stream for the current direction.
     * @param videoPlayer Video HTML Element to stream the video to.
     */
    public toggleCurrentCamera(videoPlayer: HTMLVideoElement): void {
        if (!this.canToggleLenses() || this.isStreaming) {
            return;
        }

        if (this._currDirection === 'Front') {
            this._currFrontIndex++;
            if (this._currFrontIndex >= this.frontCameras.length) {
                this._currFrontIndex = 0;
            }
            this.viewCameraStream(videoPlayer, this.frontCameras[this._currFrontIndex]);
        } else if (this._currDirection === 'Rear') {
            this._currRearIndex++;
            if (this._currRearIndex >= this.rearCameras.length) {
                this._currRearIndex = 0;
            }
            this.viewCameraStream(videoPlayer, this.rearCameras[this._currRearIndex]);
        }
    }

    /**
     * Views a camera stream in a Video HTML Element
     * @param videoPlayer Video HTML Element to stream the video to
     * @param cameraDevice The camera device to stream from. Optional - will start playing first available if not supplied.
     */
    public viewCameraStream(videoPlayer: HTMLVideoElement, cameraDevice?: ICamera): void {
        if (!cameraDevice) {
            if (this._currDirection === 'Front' && this.frontCameras.length > 0) {
                cameraDevice = this.frontCameras[this._currFrontIndex];
            } else if (this._currDirection === 'Rear' && this.rearCameras.length > 0) {
                cameraDevice = this.rearCameras[this._currRearIndex];
            } else if (this._currDirection === 'Front' &&
                this.frontCameras.length === 0 &&
                this.rearCameras.length > 0) {
                cameraDevice = this.rearCameras[this._currRearIndex];
            } else if (this._currDirection === 'Rear' &&
                this.rearCameras.length === 0 &&
                this.frontCameras.length > 0) {
                cameraDevice = this.frontCameras[this._currFrontIndex];
            } else {
                console.error('No cameras available to stream from.')
                return;
            }
        }

        if (videoPlayer) {
            videoPlayer.srcObject = null;
            this._isStreaming = false;
            setTimeout(() => {
                if (videoPlayer) {
                    videoPlayer.srcObject = this._streams.get(cameraDevice!.deviceId) as MediaStream;
                    videoPlayer.play();
                    this._currDirection = cameraDevice!.label.toLowerCase().includes('back') ? 'Rear' : 'Front';
                    if (this._currDirection === 'Front') {
                        this._currFrontIndex = this.frontCameras.findIndex(c => c.deviceId === cameraDevice!.deviceId);
                    } else if (this._currDirection === 'Rear') {
                        this._currRearIndex = this.rearCameras.findIndex(c => c.deviceId === cameraDevice!.deviceId);
                    }
                    this._isStreaming = true;
                }
            });
        }
    }

    private isApiSupported(): boolean {
        return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    }

    private getCameras(): Promise<boolean> {
        return navigator.mediaDevices.enumerateDevices().then(devices => {
            this._allCameras = devices.filter(device => device.kind === 'videoinput');
            return true;
        }).catch(err => {
            console.error('Error enumerating devices', err);
            return false;
        });
    }

    private loadCameras() {
        let loaded = 0;
        this._allCameras.forEach((d) => {
            this.checkStream(d).then(() => {
                loaded++;
                if (loaded === this._allCameras.length) {
                    this._isLoading = false;
                }
            });
        });
    }

    private checkStream(device: MediaDeviceInfo): Promise<boolean> {
        this._constaints.video.deviceId.exact = device.deviceId;
        return navigator.mediaDevices.getUserMedia(this._constaints)
            .then(stream => {
                if (stream) {
                    const rearCam = device.label.toLowerCase().includes('back');
                    if (rearCam) {
                        this._rearCameras.push(device);
                        this._streams.set(device.deviceId, stream);
                    } else {
                        this._frontCameras.push(device);
                        this._streams.set(device.deviceId, stream);
                    }
                }
                return true;
            })
            .catch(err => {
                console.error(`Camera ${device.deviceId} not available.`, err);
                return false;
            });
    }
}