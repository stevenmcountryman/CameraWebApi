import { ICamera } from './ICamera';
import { ICameraConstraints, IDimensions } from './ICameraConstraints';

export class Camera {

    protected _constraints!: ICameraConstraints;
    private _isLoading = true;
    private _allCameras: ICamera[] = [];
    private _rearCameras: ICamera[] = [];
    private _frontCameras: ICamera[] = [];
    private _currFrontIndex = 0;
    private _currRearIndex = 0;
    private _currDirection: 'Front' | 'Rear' = 'Rear';
    private _isStreaming = false;
    private _currCamera!: ICamera;

    constructor(width: IDimensions | number, height: IDimensions | number) {
        if (width !== null && height !== null) {
            this._constraints = {
                video: {
                    width: width,
                    height: height
                },
                audio: false
            };

            this.getCamerasAndPermissions();
        } else {
            console.error('Width and Height cannot be null')
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
        return this._allCameras;
    }

    /** All available rear cameras */
    public get frontCameras(): ICamera[] {
        return this._frontCameras;
    }

    /** All available front cameras */
    public get rearCameras(): ICamera[] {
        return this._rearCameras;
    }

    /** Has more than 1 available camera in the current direction. */
    public canToggleLenses(): boolean {
        if (this._currDirection === 'Front') {
            return this._frontCameras.length > 1;
        } else if (this._currDirection === 'Rear') {
            return this._rearCameras.length > 1;
        } else {
            console.error('How did we end up here? Unnaceptable outcome in canToggleLenses');
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
        if (!this.canToggleLenses() || !this.isStreaming) {
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
     * Switches the camera direction from front to rear or vice-versa
     * @param videoPlayer Video HTML Element to stream the video to.
     */
    public switchCameraDirection(videoPlayer: HTMLVideoElement): void {
        if (!this.canSwitchCameraDirections() || !this.isStreaming) {
            return;
        }

        if (this._currDirection === 'Front') {
            this.viewCameraStream(videoPlayer, this.rearCameras[this._currRearIndex]);
        } else if (this._currDirection === 'Rear') {
            this.viewCameraStream(videoPlayer, this.frontCameras[this._currFrontIndex]);
        } else {
            console.error('How did we get here? Unacceptable outcome in switchCameraDirection')
        }
    }

    /**
     * Views a camera stream in a Video HTML Element
     * @param videoPlayer Video HTML Element to stream the video to
     * @param cameraDevice The camera device to stream from. Optional - will start playing first available if not supplied.
     */
    public viewCameraStream(videoPlayer: HTMLVideoElement, cameraDevice?: ICamera): void {
        if (!cameraDevice) {
            if (this._currCamera) {
                cameraDevice = this._currCamera;
            } else if (this._currDirection === 'Front' && this.frontCameras.length > 0) {
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
                navigator.mediaDevices.getUserMedia(cameraDevice!.workingConstraints)
                    .then(stream => {
                        if (stream) {
                            this._currCamera = cameraDevice!;
                            videoPlayer.srcObject = stream;
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
            });
        }
    }

    private getCamerasAndPermissions(): void {
        setTimeout(() => {
            if (this.isApiSupported()) {
                this._isLoading = true;

                /** Prompt for permissions first - Needed for iOS */
                navigator.mediaDevices.getUserMedia({ audio: false, video: true })
                    .then(() => {
                        this.getCameras().then(success => {
                            if (success) {
                                this.loadCameras();
                            }
                        });
                    })
                    .catch(err => {
                        console.error('Failed to get necessary camera permissions: ', err);
                    });
            } else {
                console.error('Cannot get camera devices. API not supported.');
            }
        });
    }

    private isApiSupported(): boolean {
        return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    }

    private getCameras(): Promise<boolean> {
        return navigator.mediaDevices.enumerateDevices().then(devices => {
            this._allCameras = devices.filter(device => device.kind === 'videoinput').map(c => <ICamera>{
                deviceId: c.deviceId,
                label: c.label
            });
            console.log('All detected cameras:', this.allCameras);
            return true;
        }).catch(err => {
            console.error('Error enumerating devices', err);
            return false;
        });
    }

    private loadCameras() {
        let loaded = 0;
        this._allCameras.forEach((d) => {
            const newConstraints = <ICameraConstraints>{
                audio: this._constraints.audio,
                video: {
                    width: this._constraints.video.width,
                    height: this._constraints.video.height,
                    deviceId: {
                        exact: d.deviceId
                    },
                    facingMode: undefined
                }
            };
            this.checkStream(d, newConstraints).then(res => {
                if (res) {
                    loaded++;
                    if (loaded === this._allCameras.length) {
                        this.checkCamerasLoaded();
                    }
                } else {
                    newConstraints.video.width = undefined;
                    newConstraints.video.height = undefined;
                    this.checkStream(d, newConstraints).then(() => {
                        loaded++;
                        if (loaded === this._allCameras.length) {
                            this.checkCamerasLoaded();
                        }
                    });
                }
            });
        });
    }

    private checkCamerasLoaded() {
        if (this._allCameras.length > 0 && this._frontCameras.length > 0 && this._rearCameras.length > 0) {
            this._isLoading = false;
            return;
        }

        let checkedUserFacing = false;
        let checkedEnvironmentFacing = false;
        if (this._frontCameras.length === 0) {
            const newConstraints = <ICameraConstraints>{
                audio: this._constraints.audio,
                video: {
                    width: undefined,
                    height: undefined,
                    deviceId: undefined,
                    facingMode: {
                        exact: 'user'
                    }
                }
            };
            this.checkStream(<MediaDeviceInfo>{ deviceId: 'user', label: 'Front Cam' }, newConstraints).then(() => {
                checkedUserFacing = true;
                if (checkedUserFacing && checkedEnvironmentFacing) {
                    this._isLoading = false;
                }
            });
        }

        if (this._rearCameras.length === 0) {
            const newConstraints = <ICameraConstraints>{
                audio: this._constraints.audio,
                video: {
                    width: undefined,
                    height: undefined,
                    deviceId: undefined,
                    facingMode: {
                        exact: 'environment'
                    }
                }
            };
            this.checkStream(<MediaDeviceInfo>{ deviceId: 'environment', label: 'Back Cam' }, newConstraints).then(() => {
                checkedEnvironmentFacing = true;
                if (checkedUserFacing && checkedEnvironmentFacing) {
                    this._isLoading = false;
                }
            });
        }
    }

    private checkStream(device: ICamera, constraints: ICameraConstraints): Promise<boolean> {
        return navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                if (stream) {
                    const rearCam = device.label.toLowerCase().includes('back');
                    device.workingConstraints = constraints;
                    if (rearCam) {
                        this._rearCameras.push(device);
                    } else {
                        this._frontCameras.push(device);
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