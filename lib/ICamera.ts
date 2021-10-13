import { ICameraConstraints } from './ICameraConstraints';

export interface ICamera {
    deviceId: string;
    label: string;
    workingConstraints?: ICameraConstraints;
}
