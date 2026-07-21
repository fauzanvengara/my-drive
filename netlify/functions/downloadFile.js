const { google } = require("googleapis");
const { getDrive } = require("./auth");

exports.handler = async (event) => {
  try {
    const fileId = event.queryStringParameters?.id;

    if (!fileId) {
      return {
        statusCode: 400,
        body: "Missing file id"
      };
    }

    const drive = await getDrive();

    const file = await drive.files.get({
      fileId,
      fields: "webViewLink, webContentLink"
    });

    return {
      statusCode: 302,
      headers: {
        Location: file.data.webContentLink || file.data.webViewLink
      },
      body: ""
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      body: err.message
    };
  }
};