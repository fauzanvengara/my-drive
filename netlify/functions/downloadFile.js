const { getDrive } = require("./auth");

exports.handler = async (event) => {
  try {
    const drive = await getDrive();

    const fileId = event.queryStringParameters?.id;

    if (!fileId) {
      return {
        statusCode: 400,
        body: "Missing file id",
      };
    }

    const meta = await drive.files.get({
      fileId,
      fields: "name,mimeType",
    });

    const file = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      {
        responseType: "stream",
      }
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": meta.data.mimeType,
        "Content-Disposition": `inline; filename="${meta.data.name}"`,
      },
      body: file.data,
      isBase64Encoded: false,
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      body: err.message,
    };
  }
};