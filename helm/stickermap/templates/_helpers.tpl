{{/*
Return the name of the secret containing database credentials.
For CNPG mode: CNPG creates <cluster-name>-<owner>, i.e. <release>-db-stickermap.
Override via database.cnpg.secretName when using an existingCluster whose
secret follows a different naming convention.
For standalone mode: always <release>-db-stickermap (created by this chart).
*/}}
{{- define "stickermap.dbSecretName" -}}
{{- if and (eq .Values.database.mode "cnpg") .Values.database.cnpg.secretName -}}
{{- .Values.database.cnpg.secretName -}}
{{- else -}}
{{- printf "%s-db-stickermap" .Release.Name -}}
{{- end -}}
{{- end }}
