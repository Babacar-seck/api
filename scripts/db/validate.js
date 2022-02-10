const Joi = require('joi')
const chalk = require('chalk')
const { program } = require('commander')
const { logger, file, csv } = require('../core')
const schemes = require('./schemes')

program.argument('[filepath]', 'Path to file to validate').parse(process.argv)

async function main() {
	let errors = []
	const files = program.args.length
		? program.args
		: [
				'database/categories.csv',
				'database/channels.csv',
				'database/countries.csv',
				'database/languages.csv',
				'database/regions.csv',
				'database/subdivisions.csv'
		  ]
	for (const filepath of files) {
		if (!filepath.endsWith('.csv')) continue
		const data = await csv.load(filepath)

		const filename = file.getFilename(filepath)

		if (!schemes[filename]) {
			logger.error(chalk.red(`\nERR: "${filename}" scheme is missing`))
			process.exit(1)
		}

		let fileErrors = []
		if (filename === 'channels') {
			fileErrors = fileErrors.concat(findDuplicatesById(data))
		}

		const schema = Joi.object(schemes[filename])
		data.forEach((row, i) => {
			const { error } = schema.validate(row, { abortEarly: false })
			if (error) {
				error.details.forEach(detail => {
					fileErrors.push({ line: i + 2, message: detail.message })
				})
			}
		})

		if (fileErrors.length) {
			logger.info(`\n${chalk.underline(filepath)}`)
			fileErrors.forEach(err => {
				const position = err.line.toString().padEnd(6, ' ')
				logger.error(` ${chalk.gray(position)} ${err.message}`)
			})
			errors = errors.concat(fileErrors)
		}
	}

	if (errors.length) {
		logger.error(chalk.red(`\n${errors.length} error(s)`))
		process.exit(1)
	}
}

main()

function findDuplicatesById(data) {
	data = data.map(i => {
		i.id = i.id.toLowerCase()
		return i
	})

	const errors = []
	const schema = Joi.array().unique((a, b) => a.id === b.id)
	const { error } = schema.validate(data, { abortEarly: false })
	if (error) {
		error.details.forEach(detail => {
			errors.push({
				line: detail.context.pos + 2,
				message: `Entry with the id "${detail.context.value.id}" already exists`
			})
		})
	}

	return errors
}
