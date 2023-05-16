export default function(event, context) {
	return context
		.status(200)
		.succeed({
			"success": true
		});
}
