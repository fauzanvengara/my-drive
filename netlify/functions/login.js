exports.handler = async (event) => {
  try {
    const { username, password } = JSON.parse(event.body || "{}");

    if (
      username === process.env.ADMIN_USER &&
      password === process.env.ADMIN_PASS
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "Login successful"
        })
      };
    }

    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        message: "Invalid username or password"
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: err.message
      })
    };
  }
};