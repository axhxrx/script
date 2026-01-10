/**
 A step function that can be executed instead of a shell command.
 */
export type StepFn = () => void | Promise<void>;
