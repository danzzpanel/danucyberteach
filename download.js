export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST saja" });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL tidak boleh kosong" });
  }

  const RAPIDAPI_KEY = "ace85d7d86msh03c5be96d7bd343p1cc227jsn4f2e51454626




";
  const RAPIDAPI_HOST = "tiktok-api23.p.rapidapi.com";

  try {
    const response = await fetch(`https://${RAPIDAPI_HOST}/api/tiktok/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    res.status(200).json(data);

  } catch (e) {
    res.status(500).json({ error: "Server bermasalah" });
  }
}