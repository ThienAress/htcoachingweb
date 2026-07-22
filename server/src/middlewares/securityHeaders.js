import helmet from "helmet";

export const buildCspDirectives = (allowedOrigins = []) => ({
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "'unsafe-inline'",
  ],
  styleSrc: [
    "'self'",
    "https://fonts.googleapis.com",
    "'unsafe-inline'",
  ],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://res.cloudinary.com",
    "https://www.googletagmanager.com",
    "https://lh3.googleusercontent.com",
    "https://i.pravatar.cc",
    "https://images.unsplash.com",
    "https://img.vietqr.io",
    "https://placehold.co",
  ],
  mediaSrc: ["'self'", "https://res.cloudinary.com", "blob:"],
  connectSrc: [
    "'self'",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    ...allowedOrigins,
    ...(process.env.PUBLIC_API_ORIGIN
      ? [process.env.PUBLIC_API_ORIGIN]
      : []),
  ],
  frameSrc: ["'self'", "https://www.youtube.com"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  reportUri: ["/api/ops/csp-report"],
  upgradeInsecureRequests: [],
});

export const createSecurityHeaders = ({
  isProduction,
  allowedOrigins = [],
} = {}) => {
  const base = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
  if (!isProduction) return [base];
  const csp = helmet.contentSecurityPolicy({
    directives: buildCspDirectives(allowedOrigins),
    reportOnly: process.env.CSP_ENFORCE !== "true",
  });
  return [base, csp];
};
