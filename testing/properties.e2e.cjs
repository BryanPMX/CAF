// End-to-end workflow against the isolated Go fixture; never production data.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const portal = "http://127.0.0.1:3100";
const api = "http://localhost:8080/api/v1";
const artifacts = process.env.CAF_E2E_ARTIFACT_DIR || "/tmp/caf-properties-e2e";
async function login(page, email = "a@example.test") {
  await page.route("**/api/v1/**", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1"].includes(host)
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  await page.goto(portal + "/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Synthetic-E2E-Password123!");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.waitForURL(portal + "/");
  return {
    Authorization:
      "Bearer " +
      (await page.evaluate(() => localStorage.getItem("authToken"))),
  };
}
async function saveModal(page, modal, method, url) {
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith(url) && response.request().method() === method,
  );
  await modal.getByRole("button", { name: "Guardar", exact: true }).click();
  const response = await pending;
  assert.ok(response.ok(), await response.text());
  await modal.waitFor({ state: "hidden" });
  return response.json();
}

test(
  "property archive: create, register, history, source document, search and mobile layout",
  { timeout: 180000 },
  async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const headers = await login(page);
      const suffix = Date.now();
      const created = await page.request.post(api + "/admin/users", {
        headers,
        data: {
          firstName: "Propietaria",
          lastName: "Prueba " + suffix,
          email: `property-${suffix}@example.test`,
          phone: "6561234567",
          role: "client",
          officeId: 1,
          password: "Synthetic-E2E-Password123!",
          birthDate: "1980-11-24",
          personalAddress: "Domicilio sintético 123",
        },
      });
      assert.equal(created.status(), 201, await created.text());
      const person = await created.json();
      await page.getByRole("menuitem", { name: /Propiedades/ }).click();
      await page
        .getByRole("button", { name: "Registrar propiedad", exact: true })
        .click();
      let modal = page.locator(".ant-modal:visible");
      const name = "Terreno sintético " + suffix;
      // Required fields report in Spanish without sending an invalid request.
      await modal
        .getByLabel("Nombre para identificar la propiedad", { exact: true })
        .fill("");
      await modal.getByRole("button", { name: "Guardar", exact: true }).click();
      await modal.getByText("Indique un nombre.", { exact: true }).waitFor();
      await modal
        .getByLabel("Nombre para identificar la propiedad", { exact: true })
        .fill(name);
      await modal
        .getByLabel("Fraccionamiento (opcional)", { exact: true })
        .fill("Fraccionamiento de prueba");
      await modal
        .getByLabel("Superficie en metros cuadrados", { exact: true })
        .fill("33600");
      const property = await saveModal(page, modal, "POST", "/properties");
      const drawer = page.locator(".ant-drawer-content").last();
      await drawer
        .getByRole("tab", { name: "Registro Público", exact: true })
        .click();
      await drawer
        .getByRole("button", { name: "Agregar inscripción", exact: true })
        .click();
      modal = page.locator(".ant-modal:visible");
      await modal.getByLabel("Folio Real", { exact: true }).fill("0002178269");
      await modal.getByLabel("Inscripción", { exact: true }).fill("00777");
      await modal.getByLabel("Folio", { exact: true }).fill("00144");
      await modal.getByLabel("Libro", { exact: true }).fill("01064");
      await modal
        .getByLabel("Fecha del instrumento", { exact: true })
        .fill("1978-03-05");
      await saveModal(
        page,
        modal,
        "POST",
        `/properties/${property.id}/registry`,
      );
      await drawer.getByText("0002178269", { exact: true }).waitFor();
      await fs.mkdir(artifacts, { recursive: true });
      await page.screenshot({
        path: artifacts + "/property-registry-desktop.png",
        fullPage: true,
        animations: "disabled",
      });
      await drawer
        .getByRole("tab", { name: "Propietarios", exact: true })
        .click();
      await drawer
        .getByRole("button", { name: "Agregar propietario", exact: true })
        .click();
      modal = page.locator(".ant-modal:visible");
      await modal
        .getByLabel("Persona o empresa propietaria", { exact: true })
        .fill(person.email);
      await page
        .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
        .filter({ hasText: "Propietaria Prueba " + suffix })
        .click();
      await saveModal(page, modal, "POST", `/properties/${property.id}/owners`);
      await drawer.getByText("Por confirmar", { exact: true }).waitFor();
      await drawer
        .getByRole("tab", { name: "Documentos", exact: true })
        .click();
      const uploaded = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/properties/${property.id}/documents`) &&
          response.request().method() === "POST",
      );
      await drawer.locator('input[type="file"]').setInputFiles({
        name: "escritura.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Respaldo sintético"),
      });
      assert.equal((await uploaded).status(), 201);
      await drawer.getByText("escritura.txt", { exact: true }).waitFor();
      await fs.mkdir(artifacts, { recursive: true });
      await page.screenshot({
        path: artifacts + "/property-documents.png",
        fullPage: true,
        animations: "disabled",
      });
      const detail = await page.request.get(
        `${api}/properties/${property.id}`,
        { headers },
      );
      const saved = await detail.json();
      assert.equal(saved.registryEntries[0].realFolio, "0002178269");
      assert.equal(saved.owners[0].status, "reported");
      assert.equal(saved.documents.length, 1);
      assert.equal(saved.documents[0].fileURL, undefined);
      await page.goto(`${portal}/app/users/${person.id}`);
      await page
        .getByText("Domicilio sintético 123", { exact: true })
        .waitFor();
      await page.getByText(/\d+ años/).waitFor();
      // Identity comes before the portfolio, and the known owner has a readable label.
      const profileHeading = await page
        .getByRole("heading", {
          name: person.firstName + " " + person.lastName,
          exact: true,
        })
        .boundingBox();
      const archiveHeading = await page
        .getByText("Propiedades relacionadas", { exact: true })
        .boundingBox();
      assert.ok(profileHeading.y < archiveHeading.y);
      await page
        .getByRole("button", { name: "Registrar propiedad", exact: true })
        .click();
      modal = page.locator(".ant-modal:visible");
      await modal
        .getByText(person.firstName + " " + person.lastName, { exact: true })
        .waitFor({ state: "visible" });
      await modal
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
      await modal.waitFor({ state: "hidden" });

      await page.goto(portal + "/app/properties");
      await page
        .getByRole("searchbox", { name: "Buscar propiedades", exact: true })
        .fill("00777");
      await page.getByRole("button", { name, exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page
          .getByRole("button", { name: "Registrar propiedad", exact: true })
          .isVisible(),
        true,
      );
      await page.screenshot({
        path: artifacts + "/properties-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
      // The mobile form fits the viewport and protects unsaved keyboard cancellation.
      await page
        .getByRole("button", { name: "Registrar propiedad", exact: true })
        .click();
      modal = page.locator(".ant-modal:visible");
      await modal
        .getByLabel("Nombre para identificar la propiedad", { exact: true })
        .fill("Cambio sin guardar");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: artifacts + "/property-form-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
      await modal
        .getByLabel("Nombre para identificar la propiedad", { exact: true })
        .press("Escape");
      const confirm = page.getByRole("dialog", {
        name: "¿Descartar los cambios?",
        exact: true,
      });
      await confirm
        .getByRole("button", { name: "Seguir editando", exact: true })
        .click();
      assert.equal(
        await modal
          .getByLabel("Nombre para identificar la propiedad", { exact: true })
          .inputValue(),
        "Cambio sin guardar",
      );
      await modal
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "¿Descartar los cambios?", exact: true })
        .getByRole("button", { name: "Descartar cambios", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Registrar propiedad", exact: true })
        .waitFor({ state: "hidden" });
      assert.deepEqual(errors, []);
    } catch (error) {
      await fs.mkdir(artifacts, { recursive: true });
      await page.screenshot({
        path: artifacts + "/failure.png",
        fullPage: true,
        animations: "disabled",
      });
      await fs.writeFile(
        artifacts + "/failure.txt",
        await page.locator("body").innerText(),
      );
      throw error;
    } finally {
      await browser.close();
    }
  },
);

test(
  "lawyer cannot browse property metadata or documents",
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      const headers = await login(page, "lawyer@example.test");
      assert.equal(
        await page.getByRole("menuitem", { name: /Propiedades/ }).count(),
        0,
      );
      await page.goto(portal + "/app/properties");
      await page
        .getByText("Sin acceso al archivo de propiedades", { exact: true })
        .waitFor();
      assert.equal(
        (await page.request.get(api + "/properties", { headers })).status(),
        403,
      );
    } finally {
      await browser.close();
    }
  },
);
