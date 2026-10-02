'use strict';

class ChattyTrigger {
	description = {
		displayName: 'Chatty Trigger',
		name: 'chattyTrigger',
		icon: 'file:chatty.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when an event occurs in Chatty (voice call, lead captured, booking requested)',
		defaults: {
			name: 'Chatty Trigger',
		},
		inputs: [],
		outputs: ['main'],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '={{$parameter["path"]}}',
			},
		],
		properties: [
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'chatty-[bot-id]',
				required: true,
				description: 'The unique webhook path for your Chatty bot',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'All Events', value: '*' },
					{ name: 'Voice Call Completed', value: 'call_ended' },
					{ name: 'Lead Captured', value: 'lead_captured' },
					{ name: 'Booking Requested', value: 'booking_requested' },
					{ name: 'Visitor Message', value: 'message_received' },
				],
				default: ['*'],
				required: true,
				description: 'Filter which Chatty events should trigger this workflow',
			},
		],
	};

	async webhook() {
		const body = this.getBodyData();
		const events = this.getNodeParameter('events', []);
		const action = ((body.action || (body.payload && body.payload.action) || '') + '').toLowerCase();

		if (!events.includes('*')) {
			const matches = events.some((evt) => action.includes(evt));
			if (!matches) {
				return {
					noWebhookResponse: true,
				};
			}
		}

		return {
			workflowData: [
				[
					{
						json: body,
					},
				],
			],
		};
	}
}

module.exports = { ChattyTrigger };
