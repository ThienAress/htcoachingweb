const DETECT_DELAY_MS = 1000;

export const shouldEnableDevToolsGuard = ({
  isProduction,
  authLoading,
  role,
}) => Boolean(isProduction && !authLoading && role !== "admin");

export const startDevToolsDetection = (detector, onStatusChange) => {
  detector.setDetectDelay(DETECT_DELAY_MS);
  detector.addListener(onStatusChange);
  detector.launch();

  return () => {
    detector.removeListener(onStatusChange);
    detector.stop();
  };
};
