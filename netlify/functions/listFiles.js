const { getDrive } = require("./auth");

exports.handler = async (event) => {
  try {
    const drive = await getDrive();

    const folderId =
      event.queryStringParameters?.folderId ||
      process.env.DRIVE_FOLDER_ID;

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,size,modifiedTime)",
      orderBy: "folder,name",
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response.data.files),
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};