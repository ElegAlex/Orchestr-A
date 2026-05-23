// Force Europe/Paris timezone for every test run. CI runners default to
// UTC, which would silently flip edge-day leaves across calendar years.
process.env.TZ = "Europe/Paris";

import "@testing-library/jest-dom";
