'use strict';

class Chatty {
	description = {
		displayName: 'Chatty',
		name: 'chatty',
		icon: 'file:chatty.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Chatty bots, leads, and voice sessions',
		defaults: {
			name: 'Chatty',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Lead', value: 'lead' },
					{ name: 'Voice Call', value: 'voiceCall' },
					{ name: 'Bot', value: 'bot' },
				],
				default: 'lead',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['lead'],
					},
				},
				options: [
					{ name: 'Format Lead Data', value: 'formatLead', description: 'Format and sanitize captured lead' },
				],
				default: 'formatLead',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['voiceCall'],
					},
				},
				options: [
					{ name: 'Summarize Voice Call', value: 'summarizeCall', description: 'Calculate call duration, cost, and metrics' },
				],
				default: 'summarizeCall',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['bot'],
					},
				},
				options: [
					{ name: 'Format Response', value: 'formatResponse', description: 'Format response payload back to Chatty' },
				],
				default: 'formatResponse',
			},
		],
	};

	async execute() {
		const items = this.getInputData();
		const returnData = [];
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const json = item.json;

			if (resource === 'voiceCall' && operation === 'summarizeCall') {
				const duration = Number(json.duration_seconds || (json.payload && json.payload.duration_seconds) || 0);
				returnData.push({
					json: {
						event_type: 'voice_call.summary',
						session_id: json.session_id || (json.payload && json.payload.session_id) || 'unknown',
						duration_seconds: duration,
						duration_minutes: Number((duration / 60).toFixed(1)),
						followup_required: duration > 120,
						status: 'completed',
						processed_at: new Date().toISOString(),
						raw: json,
					},
				});
			} else if (resource === 'lead' && operation === 'formatLead') {
				const payload = json.payload || json;
				returnData.push({
					json: {
						event_type: 'lead.formatted',
						name: payload.customer_name || payload.name || 'Anonymous',
						email: payload.customer_email || payload.email || '',
						phone: payload.customer_phone || payload.phone || '',
						notes: payload.notes || payload.message || '',
						source: 'Chatty Automations',
						processed_at: new Date().toISOString(),
					},
				});
			} else if (resource === 'bot' && operation === 'formatResponse') {
				returnData.push({
					json: {
						success: true,
						message: 'Automation completed successfully',
						data: json,
						timestamp: new Date().toISOString(),
					},
				});
			} else {
				returnData.push({ json });
			}
		}

		return [returnData];
	}
}

module.exports = { Chatty };
