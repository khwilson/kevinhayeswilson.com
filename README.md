# Academic Website Template

This is a simple academic website template.

## Setup and Deployment

This is a jekyll website whose deployment is mnaged by gulp. You will need both
ruby and node installed to manage this website locally. To do so on a Mac using
homebrew, run

```bash
$ brew install ruby node npm
```

Once those are installed, you will need to install the dependencies of this
particular project. To do so, run

```bash
$ bundle install
$ npm install
```

To see the website locally, run

```bash
$ bundle exec jekyll serve
```

To deploy, run

```bash
gulp deploy
```
