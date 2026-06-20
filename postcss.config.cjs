// Local (empty) PostCSS config. Without this, PostCSS walks UP the directory
// tree and picks up an unrelated tailwind config in the home directory, which
// breaks the build. This project uses plain CSS — no plugins needed.
module.exports = { plugins: {} };
