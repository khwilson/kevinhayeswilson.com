const cp = require('child_process')
const gulp = require('gulp')
const ghPages = require('gulp-gh-pages')
const imagemin = require('gulp-imagemin')

const image = () => {
  return gulp.src('src/images/**/*')
      .pipe(imagemin())
      .pipe(gulp.dest('_site/images'))
}

const contentful = () => cp.spawn('bundle', ['exec', 'jekyll', 'contentful'], { stdio: 'inherit' })

const circleci = () => {
  return gulp.src('.circleci/*')
    .pipe(gulp.dest('_site/.circleci'))
}

const pushGHSource = () => cp.spawn('git', ['push', 'origin', 'source'], { stdio: 'inherit' })

const pushGHPages = () => {
  return gulp.src('_site/**/*')
             .pipe(ghPages({ force: true, branch: 'master' }))
}

const build = () => cp.spawn('bundle', ['exec', 'jekyll', 'build'], { stdio: 'inherit' })

const deploy = gulp.series(contentful, build, image, circleci, pushGHSource, pushGHPages)

module.exports = {
  circleci,
  contentful,
  image,
  pushGHSource,
  pushGHPages,
  build,
  deploy
}
