export function setCsrfCookie(res, token, options) {
  res.cookie("csrfToken", token, options);
  res.setHeader("X-CSRF-Token", token);
}
