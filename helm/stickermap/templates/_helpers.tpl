{{/*
Return the name of the secret containing database credentials.
When database.existingSecretName is set, reference that secret directly.
Otherwise the chart creates <release>-db-stickermap from the raw values.
*/}}
{{- define "stickermap.dbSecretName" -}}
{{- if .Values.database.existingSecretName -}}
{{- .Values.database.existingSecretName -}}
{{- else -}}
{{- printf "%s-db-stickermap" .Release.Name -}}
{{- end -}}
{{- end }}
