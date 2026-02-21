import ivm from "isolated-vm";

type AnyObj = Record<string, any>;

export type SandboxLimits = {
  timeoutMs: number;
  memoryMb: number;
};

function compilePrelude(code: string) {
  // Contract: code must be a JS async arrow function string.
  // Example: `async ({ spec }) => { ... }`
  return `
    "use strict";
    const __fn = (${code});
    if (typeof __fn !== "function") throw new Error("code must evaluate to a function");
    globalThis.__run = __fn;
  `;
}

export async function runSearchCode({
  code,
  spec,
  limits,
}: {
  code: string;
  spec: AnyObj;
  limits: SandboxLimits;
}): Promise<any> {
  const isolate = new ivm.Isolate({ memoryLimit: limits.memoryMb });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set("globalThis", jail.derefInto());

  // Provide spec as a copied value.
  await jail.set("spec", spec, { copy: true });

  const script = await isolate.compileScript(compilePrelude(code));
  await script.run(context, { timeout: limits.timeoutMs });

  const fnRef = await jail.get("__run", { reference: true });
  const result = await fnRef.apply(
    undefined,
    [{ spec }],
    { timeout: limits.timeoutMs, arguments: { copy: true }, result: { copy: true } },
  );
  return result;
}

export async function runExecuteCode({
  code,
  apiRequest,
  limits,
}: {
  code: string;
  apiRequest: (req: AnyObj) => Promise<any>;
  limits: SandboxLimits;
}): Promise<any> {
  const isolate = new ivm.Isolate({ memoryLimit: limits.memoryMb });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set("globalThis", jail.derefInto());

  const apiRequestRef = new ivm.Reference(async (req: AnyObj) => {
    return await apiRequest(req);
  });

  await jail.set("__apiRequest", apiRequestRef);

  // Build an api wrapper inside the isolate that can await host-side requests.
  const apiBootstrap = `
    "use strict";
    globalThis.api = {
      request: (req) => __apiRequest.applySyncPromise(undefined, [req], {
        arguments: { copy: true },
        result: { copy: true }
      })
    };
  `;

  await (await isolate.compileScript(apiBootstrap)).run(context, { timeout: limits.timeoutMs });
  await (await isolate.compileScript(compilePrelude(code))).run(context, { timeout: limits.timeoutMs });

  const fnRef = await jail.get("__run", { reference: true });
  const result = await fnRef.apply(
    undefined,
    [{ api: { request: true } }],
    { timeout: limits.timeoutMs, arguments: { copy: true }, result: { copy: true } },
  );
  return result;
}
