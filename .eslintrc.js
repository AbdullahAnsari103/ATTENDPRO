module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        node: true
    },
    extends: "eslint:recommended",
    parserOptions: {
        ecmaVersion: 12
    },
    rules: {
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
        "no-console": "off",
        "semi": ["error", "always"],
        "quotes": ["error", "single"]
    },
    ignorePatterns: [
        "node_modules/",
        "dist/",
        "build/"
    ]
};
