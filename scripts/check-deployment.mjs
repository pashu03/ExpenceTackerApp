const deploymentUrl = process.argv[2] ?? process.env.DEPLOYMENT_URL;

if (!deploymentUrl) {
  console.error(
    "Usage: npm run check:deployment -- https://your-production-domain.example",
  );
  process.exit(1);
}

const baseUrl = new URL(
  deploymentUrl.startsWith("http://") || deploymentUrl.startsWith("https://")
    ? deploymentUrl
    : `https://${deploymentUrl}`,
);

const checks = [
  {
    path: "/health",
    expectedStatus: 200,
    validate: (body) => body.status === "ok",
    expectedBody: '{"status":"ok"}',
  },
  {
    path: "/health/ready",
    expectedStatus: 200,
    validate: (body) => body.status === "ready",
    expectedBody: '{"status":"ready"}',
  },
  {
    path: "/api/v1/auth/me",
    expectedStatus: 401,
    validate: (body) => body.code === "INVALID_SESSION",
    expectedBody: "an INVALID_SESSION problem response",
  },
];

let failed = false;

for (const check of checks) {
  const url = new URL(check.path, baseUrl);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("json") ? await response.json() : null;
    const passed = response.status === check.expectedStatus && body && check.validate(body);

    if (passed) {
      console.log(`PASS ${check.path} (${response.status})`);
    } else {
      failed = true;
      console.error(
        `FAIL ${check.path}: received ${response.status} ${contentType || "without content type"}; expected ${check.expectedStatus} and ${check.expectedBody}`,
      );
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${check.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Deployment API checks passed for ${baseUrl.origin}.`);
}
