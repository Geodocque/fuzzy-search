export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/file") {
      return new Response("Not found", { status: 404 });
    }

    const fileName = url.searchParams.get("name");
    const allowedFiles = new Set(["records.json", "trigram_index.json"]);

    if (!fileName || !allowedFiles.has(fileName)) {
      return new Response("Forbidden", { status: 403 });
    }

    const object = await env.APP_DATA_BUCKET.get(fileName);

    if (!object) {
      return new Response("File not found", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=300"
      }
    });
  }
};
