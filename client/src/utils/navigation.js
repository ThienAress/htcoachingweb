let navigate = null;

export const setNavigate = (nav) => {
  navigate = nav;
};

export const redirectTo = (path) => {
  if (navigate) {
    navigate(path);
  } else {
    window.location.href = path; // fallback
  }
};
