from flask import jsonify, request


def get_json_body():
    """Return parsed JSON body or an empty dict."""
    return request.get_json() or {}


def json_response(data=None, message=None, error=None, status=200):
    payload = {'success': error is None}
    if data is not None:
        payload['data'] = data
    if message is not None:
        payload['message'] = message
    if error is not None:
        payload['error'] = error
    return jsonify(payload), status


def validate_required_fields(data, required_fields):
    """Return first missing required field name, or None if all are present."""
    for field in required_fields:
        if not data.get(field):
            return field
    return None


def parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
