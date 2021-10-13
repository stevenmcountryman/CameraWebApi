interface IDevice {
    exact: string;
}

interface IVideo {
    width?: IDimensions | number;
    height?: IDimensions | number;
    deviceId?: IDevice;
}

export interface IDimensions {
    min?: number;
    ideal: number;
    max?: number;
}

export interface ICameraConstraints {
    video: IVideo;
    audio: boolean;
}
