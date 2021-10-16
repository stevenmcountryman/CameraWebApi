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

    private _initializeResolve?: (value: any) => void;
    private _initializeReject?: (reason?: any) => void;

    constructor(width: IDimensions | number, height: IDimensions | number) {
        if (width !== null && height !== null) {
            this._constraints = {
                video: {
                    width: width,
                    height: height
                },
                audio: false
            };
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

    /** Initialized camera permissions and devices.
     * @returns a promise when the cameras are initialized. Rejects if fails.
     */
    public initialize(): Promise<any> {
        this._isLoading = true;
        return new Promise((resolve, reject) => {
            this._initializeResolve = resolve;
            this._initializeReject = reject;

            if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
                navigator.mediaDevices.getUserMedia({ audio: false, video: true })
                    .then(() => {
                        this.getCameras();
                    })
                    .catch(() => {
                        this._initializeReject!('Failed to get necessary camera permissions.');
                    });
            } else {
                this._initializeReject('Camera Web APIs not supported by this device.');
            }
        });
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

    private getCameras(): void {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            if (devices && devices.length > 0) {
                this._allCameras = devices.filter(device => device.kind === 'videoinput').map(c => <ICamera>{
                    deviceId: c.deviceId,
                    label: c.label
                });
                this.loadCameras();
            } else {
                this._initializeReject!('No camera detected.');
            }
        }).catch(() => {
            this._initializeReject!('Error detecting device cameras.');
        });
    }

    private loadCameras(index?: number): void {
        index = index !== undefined ? index : 0;

        if (index >= this.allCameras.length) {
            this.checkCamerasLoaded();
            return;
        }

        const camera = this._allCameras[index];
        const newConstraints = <ICameraConstraints>{
            audio: this._constraints.audio,
            video: {
                width: this._constraints.video.width,
                height: this._constraints.video.height,
                deviceId: {
                    exact: camera.deviceId
                },
                facingMode: undefined
            }
        };
        this.checkStream(camera, newConstraints)
            .then(res => {
                if (res) {
                    this.loadCameras(index! + 1);
                } else {
                    newConstraints.video.width = undefined;
                    newConstraints.video.height = undefined;
                    this.checkStream(camera, newConstraints).then(() => {
                        this.loadCameras(index! + 1);
                    });
                }
            });
    }

    private checkCamerasLoaded(skipFront?: boolean, skipRear?: boolean) {
        if (this._allCameras.length > 0 && this._frontCameras.length > 0 && this._rearCameras.length > 0) {
            this._isLoading = false;
            this._initializeResolve!('All available cameras accounted for');
            return;
        }

        const newConstraints = <ICameraConstraints>{
            audio: this._constraints.audio,
            video: {
                width: undefined,
                height: undefined,
                deviceId: undefined,
                facingMode: {
                    exact: ''
                }
            }
        };

        if (this._frontCameras.length === 0 && !skipFront) {
            newConstraints.video.facingMode!.exact = 'user';
            this.checkStream(<MediaDeviceInfo>{ deviceId: 'user', label: 'Front Cam' }, newConstraints).then(() => {
                this.checkCamerasLoaded(true);
            });
            return;
        }

        newConstraints.video.facingMode!.exact = 'environment';
        if (this._rearCameras.length === 0 && !skipRear) {
            this.checkStream(<MediaDeviceInfo>{ deviceId: 'environment', label: 'Back Cam' }, newConstraints).then(() => {
                this.checkCamerasLoaded(skipFront, true);
            });
            return;
        }

        this._isLoading = false;
        this._initializeResolve!('All available cameras accounted for');
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
                return false;
            });
    }
}