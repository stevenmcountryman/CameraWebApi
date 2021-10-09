interface IDevice {
    exact: string;
}

interface IVideo {
    width: IDimensions;
    height: IDimensions;
    deviceId: IDevice;
}

export interface IDimensions {
    min?: number;
    ideal: number;
    max?: number;
}

export interface ICameraConstraints {
    video: IVideo;
}
