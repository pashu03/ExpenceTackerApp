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
    expectedStatuses: [200],
    validate: (body) => body.status === "ok",
    expectedBody: '{"status":"ok"}',
  },
  {
    path: "/health/ready",
    expectedStatuses: [200],
    validate: (body) => body.status === "ready",
    expectedBody: '{"status":"ready"}',
  },
  {
    path: "/api/v1/auth/me",
    expectedStatuses: [401],
    validate: (body) => body.code === "INVALID_SESSION",
    expectedBody: "an INVALID_SESSION problem response",
  },
  {
    path: "/api/v1/auth/login",
    method: "POST",
    body: {
      email: "deployment-check@lifetracker.example.com",
      password: "not-a-real-password1",
    },
    expectedStatuses: [401, 429],
    validate: (body) =>
      body.code === "INVALID_CREDENTIALS" || body.code === "LOGIN_RATE_LIMITED",
    expectedBody: "an INVALID_CREDENTIALS or LOGIN_RATE_LIMITED problem response",
  },
];

let failed = false;

for (const check of checks) {
  const url = new URL(check.path, baseUrl);
  try {
    const response = await fetch(url, {
      method: check.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(check.body ? { "Content-Type": "application/json" } : {}),
      },
      body: check.body ? JSON.stringify(check.body) : undefined,
      redirect: "error",
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("json") ? await response.json() : null;
    const passed =
      check.expectedStatuses.includes(response.status) && body && check.validate(body);

    if (passed) {
      console.log(`PASS ${check.path} (${response.status})`);
    } else {
      failed = true;
      console.error(
        `FAIL ${check.path}: received ${response.status} ${contentType || "without content type"}; expected ${check.expectedStatuses.join(" or ")} and ${check.expectedBody}`,
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
